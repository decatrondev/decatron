using Decatron.Core.Helpers;
using Decatron.Core.Models.LiveTranslation;
using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Decatron.Services.LiveTranslation
{
    /// <summary>
    /// La política de acceso ya resuelta de un canal: lo que eligió el streamer, recortado por el techo de su plan y por los
    /// límites del sistema. El hub la consulta en cada entrada, así que se guarda 30 s en memoria (y se invalida al guardar).
    /// </summary>
    public sealed record AccessPolicy(
        long UserId, string Login, string Tier, bool Paused,
        int MaxListenersTotal, int MaxListenersPerLanguage, int MaxActiveLanguages, int MaxConnectionsPerIp, int MaxConnectionsPerUser,
        IReadOnlyList<string> Languages);

    public sealed class TranslationAccessService : Decatron.Hubs.ITranslationAccessGate
    {
        public const int MaxConnectionsPerIpCeiling = 10;
        private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(30);

        private readonly IServiceScopeFactory _scopes;
        private readonly IMemoryCache _cache;
        private readonly IOptionsMonitor<LiveTranslationOptions> _options;
        private readonly ILogger<TranslationAccessService> _logger;

        public TranslationAccessService(IServiceScopeFactory scopes, IMemoryCache cache, IOptionsMonitor<LiveTranslationOptions> options, ILogger<TranslationAccessService> logger)
        {
            _scopes = scopes;
            _cache = cache;
            _options = options;
            _logger = logger;
        }

        public void Invalidate(string login) => _cache.Remove(Key(login));

        public async Task<Decatron.Hubs.TranslationLimits?> GetLimitsAsync(string login)
        {
            var p = await GetPolicyAsync(login);
            return p == null ? null : new Decatron.Hubs.TranslationLimits(p.Paused, p.MaxListenersTotal, p.MaxListenersPerLanguage, p.MaxActiveLanguages, p.MaxConnectionsPerIp, p.Languages);
        }
        private static string Key(string login) => "lt-access:" + login.ToLowerInvariant();

        /// <summary>La política del canal; null si el canal no existe o no tiene la traducción encendida.</summary>
        public async Task<AccessPolicy?> GetPolicyAsync(string login)
        {
            login = login.ToLowerInvariant();
            if (_cache.TryGetValue(Key(login), out AccessPolicy? hit)) return hit;

            AccessPolicy? policy = null;
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<DecatronDbContext>();
                var row = await (
                    from u in db.Users.AsNoTracking()
                    join s in db.LiveTranslationSettings.AsNoTracking() on u.Id equals s.UserId
                    where u.Login.ToLower() == login && s.Enabled
                    select new { u.Id, s.TargetLanguages }
                ).FirstOrDefaultAsync();
                if (row != null)
                {
                    var access = await db.LiveTranslationAccess.AsNoTracking().FirstOrDefaultAsync(a => a.UserId == row.Id);
                    var tier = await TierResolver.GetEffectiveTierAsync(db, row.Id);
                    policy = Resolve(row.Id, login, tier, access, _options.CurrentValue.MaxLanguagesPerChannel,
                        row.TargetLanguages.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
                }
            }
            catch (Exception ex)
            {
                // Si la base falla no se abre de más: se usa la política recomendada del plan gratis.
                _logger.LogWarning(ex, "[LiveTranslation] No se pudo leer la política de acceso de {Login}", login);
                policy = Resolve(0, login, "free", null, _options.CurrentValue.MaxLanguagesPerChannel, Array.Empty<string>());
            }

            // Un canal sin traducción encendida no se guarda como null (el hub aplica solo los límites generales).
            if (policy != null) _cache.Set(Key(login), policy, Ttl);
            return policy;
        }

        /// <summary>Lo que eligió el streamer (o el preset recomendado) recortado por el techo de su plan y los límites del sistema.</summary>
        public static AccessPolicy Resolve(long userId, string login, string tier, LiveTranslationAccess? a, int systemMaxLanguages, IReadOnlyList<string> languages)
        {
            var limits = LiveTranslationTierLimits.ForTier(tier);
            var total = Math.Clamp(a?.MaxListenersTotal ?? limits.DefaultListeners, 1, limits.MaxListeners);
            var perLang = Math.Clamp(a?.MaxListenersPerLanguage ?? total, 1, total);
            var langs = Math.Clamp(a?.MaxActiveLanguages ?? 2, 1, Math.Max(1, systemMaxLanguages));
            var perIp = Math.Clamp(a?.MaxConnectionsPerIp ?? 3, 1, MaxConnectionsPerIpCeiling);
            var perUser = Math.Clamp(a?.MaxConnectionsPerUser ?? 2, 1, MaxConnectionsPerIpCeiling);
            return new AccessPolicy(userId, login, tier, a?.Paused ?? false, total, perLang, langs, perIp, perUser, languages);
        }
    }
}
