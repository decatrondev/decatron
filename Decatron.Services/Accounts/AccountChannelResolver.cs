using System.Collections.Concurrent;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;

namespace Decatron.Services.Accounts
{
    /// <summary>
    /// Convierte cualquier alias de un canal (login de Twitch, kick_&lt;id&gt;, KickId numérico, id de usuario) en la
    /// cuenta completa y su fila principal. Todo módulo multiplataforma debe emitir a <c>overlay_{OverlayKey}</c>
    /// y a un solo grupo (SignalR entrega dos veces si una conexión está en dos grupos que reciben el mismo envío).
    /// Plan: .dev/plans/CHAT_UNIFICADO_PLAN.md, fase 1.
    /// </summary>
    public class AccountChannelResolver
    {
        private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(30);

        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<AccountChannelResolver> _logger;
        private readonly ConcurrentDictionary<string, (DateTime At, object? Value)> _cache = new();

        public AccountChannelResolver(IServiceScopeFactory scopes, ILogger<AccountChannelResolver> logger)
        {
            _scopes = scopes;
            _logger = logger;
        }

        /// <summary>Hay que llamarlo cuando cambian las filas de una cuenta (vincular o desvincular un canal)</summary>
        public void Invalidate() => _cache.Clear();

        /// <summary>
        /// Resuelve el alias de la URL de un overlay o el canal de un comando. Prueba primero el login (caso común,
        /// igual que <c>ChannelResolver</c>) y después el KickId numérico.
        /// </summary>
        public async Task<ResolvedAlias?> ResolveAliasAsync(string? alias)
        {
            var trimmed = alias?.Trim();
            if (string.IsNullOrEmpty(trimmed)) return null;
            return await ResolveLoginAsync(trimmed) ?? await ResolveKickIdAsync(trimmed);
        }

        /// <summary>Un canal por su login (el de Twitch, o kick_&lt;id&gt; en las cuentas de Kick)</summary>
        public async Task<ResolvedAlias?> ResolveLoginAsync(string? login)
        {
            var key = login?.Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(key)) return null;
            return await CachedAsync($"l:{key}", db => ResolveRowAsync(db, FindRowAsync(db, u => u.Login == key)));
        }

        /// <summary>Un canal por el id numérico de Kick (así llegan los eventos del webhook y los comandos)</summary>
        public async Task<ResolvedAlias?> ResolveKickIdAsync(string? kickId)
        {
            var key = kickId?.Trim();
            if (string.IsNullOrEmpty(key)) return null;
            return await CachedAsync($"k:{key}", db => ResolveRowAsync(db, FindRowAsync(db, u => u.KickId == key)));
        }

        private static async Task<ResolvedAlias?> ResolveRowAsync(DecatronDbContext db, Task<ChannelRow?> find)
        {
            var row = await find;
            if (row == null) return null;
            var account = await LoadAccountAsync(db, row);
            var matched = account.Members.First(m => m.UserId == row.UserId);
            return new ResolvedAlias(account, matched, AccountChannelPicker.LegacyVariant(row));
        }

        /// <summary>La cuenta a la que pertenece una fila (para endpoints que ya conocen el user_id)</summary>
        public async Task<AccountChannels?> ResolveByUserIdAsync(long userId) =>
            await CachedAsync($"u:{userId}", async db =>
            {
                var row = await FindRowAsync(db, u => u.Id == userId);
                return row == null ? null : await LoadAccountAsync(db, row);
            });

        private static async Task<ChannelRow?> FindRowAsync(DecatronDbContext db, System.Linq.Expressions.Expression<Func<Core.Models.User, bool>> where)
        {
            var r = await db.Users.AsNoTracking().Where(u => u.IsActive).Where(where)
                .Select(u => new { u.Id, u.AccountId, u.Login, u.TwitchId, u.KickId, u.KickUsername })
                .OrderBy(u => u.Id).FirstOrDefaultAsync();
            return r == null ? null : new ChannelRow(r.Id, r.AccountId, r.Login, r.TwitchId, r.KickId, r.KickUsername);
        }

        private static async Task<AccountChannels> LoadAccountAsync(DecatronDbContext db, ChannelRow row)
        {
            var rows = new List<ChannelRow> { row };
            if (row.AccountId != null)
            {
                var accountId = row.AccountId;
                var siblings = await db.Users.AsNoTracking().Where(u => u.IsActive && u.AccountId == accountId && u.Id != row.UserId)
                    .Select(u => new { u.Id, u.AccountId, u.Login, u.TwitchId, u.KickId, u.KickUsername }).ToListAsync();
                rows.AddRange(siblings.Select(r => new ChannelRow(r.Id, r.AccountId, r.Login, r.TwitchId, r.KickId, r.KickUsername)));
            }
            return AccountChannelPicker.Build(rows)!;
        }

        private async Task<T?> CachedAsync<T>(string key, Func<DecatronDbContext, Task<T?>> load) where T : class
        {
            if (_cache.TryGetValue(key, out var hit) && DateTime.UtcNow - hit.At < Ttl)
                return (T?)hit.Value;
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var value = await load(db);
                _cache[key] = (DateTime.UtcNow, value);
                return value;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[AccountChannelResolver] No se pudo resolver {Key}", key);
                return _cache.TryGetValue(key, out var old) ? (T?)old.Value : null;
            }
        }
    }
}
