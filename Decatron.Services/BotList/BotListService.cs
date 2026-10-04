using System.Collections.Concurrent;
using Decatron.Core.Helpers;
using Decatron.Core.Interfaces;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Decatron.Services.BotList
{
    /// <summary>
    /// Responde "¿este usuario es un bot en este canal?" en cada mensaje, así que todo sale de
    /// caché en memoria: el catálogo (60 s), los bots de cada canal (30 s, se invalida al guardar)
    /// y la resolución canal → usuario interno (5 min).
    /// </summary>
    public class BotListService : IBotListService
    {
        private static readonly TimeSpan ChannelTtl = TimeSpan.FromSeconds(30);
        private static readonly TimeSpan CatalogTtl = TimeSpan.FromSeconds(60);
        private static readonly TimeSpan ResolveTtl = TimeSpan.FromMinutes(5);
        private static readonly TimeSpan RetryAfterError = TimeSpan.FromSeconds(10);

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<BotListService> _logger;

        private readonly ConcurrentDictionary<long, (DateTime At, IReadOnlyDictionary<string, BotEffects> Bots)> _channels = new();
        private readonly ConcurrentDictionary<string, (DateTime At, long? UserId)> _resolved = new();
        private (DateTime At, List<CatalogRow> Rows)? _catalog;
        private readonly SemaphoreSlim _catalogLock = new(1, 1);

        private sealed record CatalogRow(string Platform, string Username, string DisplayName, string Category);

        public BotListService(IServiceScopeFactory scopeFactory, ILogger<BotListService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        /// <summary>Usuario como se guarda: minúsculas y, en Kick, con "_" en lugar de "-"</summary>
        public static string NormalizeUsername(string platform, string username)
        {
            var u = (username ?? "").Trim().TrimStart('@').ToLowerInvariant();
            return platform == "kick" ? u.Replace('-', '_') : u;
        }

        public static string Key(string platform, string username) => $"{platform}:{NormalizeUsername(platform, username)}";

        public async Task<BotEffects?> GetEffectsAsync(string platform, string channel, string username)
        {
            if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(channel))
                return null;

            var userId = await ResolveChannelAsync(channel);
            if (userId == null)
                return null;

            return await GetEffectsAsync(platform, userId.Value, username);
        }

        public async Task<BotEffects?> GetEffectsAsync(string platform, long channelUserId, string username)
        {
            if (string.IsNullOrWhiteSpace(username))
                return null;

            var bots = await GetChannelBotsAsync(channelUserId);
            return bots.TryGetValue(Key(platform, username), out var fx) ? fx : null;
        }

        public async Task<IReadOnlyDictionary<string, BotEffects>> GetChannelBotsAsync(long channelUserId)
        {
            if (_channels.TryGetValue(channelUserId, out var cached) && DateTime.UtcNow - cached.At < ChannelTtl)
                return cached.Bots;

            try
            {
                var catalog = await GetCatalogAsync();

                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var rows = await db.ChannelBotEntries.AsNoTracking()
                    .Where(r => r.UserId == channelUserId)
                    .ToListAsync();

                var bots = Merge(catalog, rows);
                _channels[channelUserId] = (DateTime.UtcNow, bots);
                return bots;
            }
            catch (Exception ex)
            {
                // Si la base falla, la lista de bots nunca debe frenar el chat: se usa lo último que hubo
                _logger.LogWarning(ex, "[BotList] No se pudo cargar la lista del canal {UserId}", channelUserId);
                // Se reintenta en 10 s, no en cada mensaje: con la base caída no hay que golpearla por cada línea del chat
                var fallback = _channels.TryGetValue(channelUserId, out var old) ? old.Bots : new Dictionary<string, BotEffects>();
                _channels[channelUserId] = (DateTime.UtcNow - ChannelTtl + RetryAfterError, fallback);
                return fallback;
            }
        }

        /// <summary>El catálogo más lo que el canal cambió o agregó</summary>
        public static Dictionary<string, BotEffects> MergeForTests(IEnumerable<(string Platform, string Username, string DisplayName, string Category)> catalog,
            IEnumerable<Core.Models.ChannelBotEntry> rows) =>
            Merge(catalog.Select(c => new CatalogRow(c.Platform, c.Username, c.DisplayName, c.Category)).ToList(), rows);

        private static Dictionary<string, BotEffects> Merge(List<CatalogRow> catalog, IEnumerable<Core.Models.ChannelBotEntry> rows)
        {
            var overrides = rows.ToDictionary(r => Key(r.Platform, r.Username));
            var result = new Dictionary<string, BotEffects>();

            foreach (var c in catalog)
            {
                var key = Key(c.Platform, c.Username);
                overrides.TryGetValue(key, out var row);
                if (row != null && !row.IsCustom && !row.Enabled)
                    continue;
                // Un bot propio con el mismo nombre que uno del catálogo manda sobre el catálogo
                if (row != null && row.IsCustom)
                    continue;

                result[key] = Build(c.Platform, c.Username, c.DisplayName, c.Category, isCustom: false, row);
            }

            foreach (var row in rows.Where(r => r.IsCustom && r.Enabled))
            {
                var category = BotCategories.IsValidCategory(row.Category) ? row.Category! : "utilidad";
                var name = string.IsNullOrWhiteSpace(row.DisplayName) ? row.Username : row.DisplayName!;
                result[Key(row.Platform, row.Username)] = Build(row.Platform, row.Username, name, category, isCustom: true, row);
            }

            return result;
        }

        private static BotEffects Build(string platform, string username, string displayName, string category, bool isCustom, Core.Models.ChannelBotEntry? row)
        {
            var d = BotCategories.DefaultsFor(category);
            return new BotEffects(
                platform,
                NormalizeUsername(platform, username),
                displayName,
                category,
                isCustom,
                row?.HideOverlay ?? d.HideOverlay,
                row?.SkipCounting ?? d.SkipCounting,
                row?.SkipCommands ?? d.SkipCommands,
                row?.SkipModeration ?? d.SkipModeration,
                row?.SkipSpeech ?? d.SkipSpeech);
        }

        private async Task<List<CatalogRow>> GetCatalogAsync()
        {
            if (_catalog is { } c && DateTime.UtcNow - c.At < CatalogTtl)
                return c.Rows;

            await _catalogLock.WaitAsync();
            try
            {
                if (_catalog is { } c2 && DateTime.UtcNow - c2.At < CatalogTtl)
                    return c2.Rows;

                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var rows = await db.BotCatalog.AsNoTracking()
                    .Select(b => new CatalogRow(b.Platform, b.Username, b.DisplayName, b.Category))
                    .ToListAsync();
                _catalog = (DateTime.UtcNow, rows);
                return rows;
            }
            finally
            {
                _catalogLock.Release();
            }
        }

        private async Task<long?> ResolveChannelAsync(string channel)
        {
            var key = channel.ToLowerInvariant();
            if (_resolved.TryGetValue(key, out var hit) && DateTime.UtcNow - hit.At < ResolveTtl)
                return hit.UserId;

            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var info = await ChannelResolver.ResolveChannelInfoAsync(db, channel);
                _resolved[key] = (DateTime.UtcNow, info?.UserId);
                return info?.UserId;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[BotList] No se pudo resolver el canal {Channel}", channel);
                _resolved[key] = (DateTime.UtcNow - ResolveTtl + RetryAfterError, null);
                return null;
            }
        }

        public void InvalidateChannel(long channelUserId) => _channels.TryRemove(channelUserId, out _);

        public void InvalidateCatalog()
        {
            _catalog = null;
            _channels.Clear();
        }
    }
}
