using Decatron.Data;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Decatron.Core.Helpers
{
    /// <summary>
    /// Resolución centralizada del tier efectivo de un usuario y de los límites
    /// asociados a ese tier. Antes esta lógica estaba duplicada en el servicio de
    /// Speak Chat, en su controller y en AuthController, con reglas distintas.
    /// </summary>
    public static class TierResolver
    {
        public const string AdminTier = "admin";

        /// <summary>Caracteres Polly/mes por tier cuando no hay fila en tier_features. -1 = ilimitado.</summary>
        public static readonly IReadOnlyDictionary<string, long> DefaultPollyCharLimits =
            new Dictionary<string, long>
            {
                ["free"]      = 0,
                ["supporter"] = 150_000,
                ["premium"]   = 500_000,
                ["fundador"]  = 2_000_000,
                [AdminTier]   = Unlimited
            };

        /// <summary>Valor sentinela para "sin límite".</summary>
        public const long Unlimited = -1;

        /// <summary>
        /// Tier efectivo del usuario: los admins/owners de system_admins siempre son
        /// "admin" (aunque no tengan fila en user_subscription_tiers), el resto usa
        /// su suscripción activa y cae a "free" si no hay ninguna.
        /// </summary>
        public static async Task<string> GetEffectiveTierAsync(DecatronDbContext db, long userId)
        {
            var login = await db.Users
                .Where(u => u.Id == userId)
                .Select(u => u.Login)
                .FirstOrDefaultAsync();

            if (!string.IsNullOrEmpty(login))
            {
                var isAdmin = await db.SystemAdmins
                    .AnyAsync(a => a.Username.ToLower() == login.ToLower() &&
                                   (a.Role == "owner" || a.Role == "admin"));
                if (isAdmin) return AdminTier;
            }

            var tier = await db.UserSubscriptionTiers
                .Where(t => t.UserId == userId &&
                            (t.TierExpiresAt == null || t.TierExpiresAt > DateTimeOffset.UtcNow))
                .OrderByDescending(t => t.TierStartedAt)
                .Select(t => t.Tier)
                .FirstOrDefaultAsync();

            return string.IsNullOrEmpty(tier) ? "free" : tier;
        }

        /// <summary>Fecha de expiración del tier activo (null = permanente o sin tier).</summary>
        public static async Task<DateTimeOffset?> GetTierExpiryAsync(DecatronDbContext db, long userId)
        {
            return await db.UserSubscriptionTiers
                .Where(t => t.UserId == userId &&
                            (t.TierExpiresAt == null || t.TierExpiresAt > DateTimeOffset.UtcNow))
                .OrderByDescending(t => t.TierStartedAt)
                .Select(t => t.TierExpiresAt)
                .FirstOrDefaultAsync();
        }

        /// <summary>
        /// True si el tier anterior terminó por vencimiento natural de su ciclo pagado
        /// —existe la fila y su fecha ya pasó— en vez de por una bajada o retirada manual.
        ///
        /// Sirve para decidir si se le recorta la cuota de créditos a mitad de mes: a quien
        /// pagó un mes completo y simplemente se le acabó no se le quita nada hasta el día 1;
        /// a quien se le retira el tier antes de tiempo, sí.
        /// </summary>
        public static async Task<bool> ExpiredNaturallyAsync(DecatronDbContext db, long userId)
        {
            var lastExpiry = await db.UserSubscriptionTiers
                .Where(t => t.UserId == userId)
                .OrderByDescending(t => t.TierStartedAt)
                .Select(t => t.TierExpiresAt)
                .FirstOrDefaultAsync();

            return lastExpiry != null && lastExpiry <= DateTimeOffset.UtcNow;
        }

        /// <summary>
        /// Límite mensual de caracteres Polly del tier. Devuelve <see cref="Unlimited"/> (-1)
        /// si el tier no tiene tope.
        /// </summary>
        public static async Task<long> GetPollyCharLimitAsync(DecatronDbContext db, string tier)
        {
            var feature = await db.TierFeatures
                .FirstOrDefaultAsync(f => f.Tier == tier && f.FeatureKey == "speak_chat_polly_chars_monthly");

            if (feature != null && long.TryParse(feature.FeatureValue, out var dbLimit))
                return dbLimit;

            return DefaultPollyCharLimits.TryGetValue(tier, out var defaultLimit) ? defaultLimit : 0;
        }
    }
}
