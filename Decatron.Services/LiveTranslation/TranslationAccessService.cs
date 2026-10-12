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
        IReadOnlyList<string> Languages,
        string Mode, int MinFollowDays, int MinSubTier, IReadOnlySet<string> AllowList, IReadOnlySet<string> BlockList);

    public sealed class TranslationAccessService : Decatron.Hubs.ITranslationAccessGate
    {
        public const int MaxConnectionsPerIpCeiling = 10;
        private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(30);

        private readonly IServiceScopeFactory _scopes;
        private readonly IMemoryCache _cache;
        private readonly IOptionsMonitor<LiveTranslationOptions> _options;
        private readonly ILogger<TranslationAccessService> _logger;
        private readonly StreamerRoleService _roles;
        private readonly TranslationAbuseGuard _abuse;

        public TranslationAccessService(IServiceScopeFactory scopes, IMemoryCache cache, IOptionsMonitor<LiveTranslationOptions> options, ILogger<TranslationAccessService> logger, StreamerRoleService roles, TranslationAbuseGuard abuse)
        {
            _abuse = abuse;
            _roles = roles;
            _scopes = scopes;
            _cache = cache;
            _options = options;
            _logger = logger;
        }

        public void Invalidate(string login) => _cache.Remove(Key(login));

        /// <summary>
        /// ¿Puede esta persona escuchar el canal? Aplica el nivel que eligió el streamer, las listas y el bloqueo. Un canal sin la traducción
        /// encendida no limita a nadie aquí (no hay nada que escuchar). El rol de Twitch se consulta con el token del streamer y se guarda.
        /// </summary>
        public async Task<Decatron.Hubs.ViewerCheckResult> CheckViewerAsync(string login, Decatron.Hubs.ViewerIdentity? who)
        {
            var policy = await GetPolicyAsync(login);
            if (policy == null) return Decatron.Hubs.ViewerCheckResult.Allowed;
            // Endurecimiento automático por abuso: un canal abierto pide sesión mientras dura. No cambia lo que el streamer guardó.
            if (policy.Mode == "everyone" && _abuse.Active(login) != null) policy = policy with { Mode = "logged_in" };
            return await AccessEvaluator.EvaluateAsync(policy, who, () => _roles.GetRoleAsync(policy.UserId, policy.Mode, who!.TwitchId!));
        }

        public async Task<Decatron.Hubs.TranslationLimits?> GetLimitsAsync(string login)
        {
            var p = await GetPolicyAsync(login);
            return p == null ? null : new Decatron.Hubs.TranslationLimits(p.Paused, p.MaxListenersTotal, p.MaxListenersPerLanguage, p.MaxActiveLanguages, p.MaxConnectionsPerIp, p.MaxConnectionsPerUser, p.Languages);
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
            var mode = a != null && AccessEvaluator.Modes.Contains(a.Mode) ? a.Mode : "everyone";
            return new AccessPolicy(userId, login, tier, a?.Paused ?? false, total, perLang, langs, perIp, perUser, languages,
                mode, Math.Clamp(a?.MinFollowDays ?? 7, 0, 3650), Math.Clamp(a?.MinSubTier ?? 1, 1, 3),
                AccessEvaluator.ParseList(a?.AllowList), AccessEvaluator.ParseList(a?.BlockList));
        }
    }
}
