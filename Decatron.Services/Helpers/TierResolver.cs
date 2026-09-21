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

        /// <summary>
        /// Bytes de almacenamiento de medios por tier cuando no hay fila en
        /// tier_features. A diferencia de comandos/overlays/variantes (filas de
        /// BD, casi gratis), storage es disco real — por eso Fundador tiene un
        /// tope generoso y no "ilimitado" como el resto de sus beneficios.
        /// </summary>
        public static readonly IReadOnlyDictionary<string, long> DefaultStorageLimits =
            new Dictionary<string, long>
            {
                ["free"]      = 500L * 1024 * 1024,
                ["supporter"] = 2L * 1024 * 1024 * 1024,
                ["premium"]   = 5L * 1024 * 1024 * 1024,
                ["fundador"]  = 15L * 1024 * 1024 * 1024,
                [AdminTier]   = Unlimited
            };

        /// <summary>
        /// Ruedas de la Suerte habilitadas por tier (sección 11 del plan de la Rueda).
        /// Son filas de BD, casi gratis, así que Fundador y admin van sin tope.
        /// </summary>
        public static readonly IReadOnlyDictionary<string, long> DefaultWheelLimits =
            new Dictionary<string, long>
            {
                ["free"]      = 2,
                ["supporter"] = 5,
                ["premium"]   = 15,
                ["fundador"]  = Unlimited,
                [AdminTier]   = Unlimited
            };

        /// <summary>
        /// Gajos por rueda según el tier. Acá nadie va "ilimitado" ni siquiera admin:
        /// el tope no es de costo sino de legibilidad — una rueda con cien gajos no se
        /// lee en pantalla, y dejar que alguien la arme sería dejarlo romper su overlay.
        /// </summary>
        public static readonly IReadOnlyDictionary<string, long> DefaultWheelSegmentLimits =
            new Dictionary<string, long>
            {
                ["free"]      = 12,
                ["supporter"] = 24,
                ["premium"]   = 48,
                ["fundador"]  = 48,
                [AdminTier]   = 48
            };

        /// <summary>
        /// Cuántos días de historial de giros se ven en el panel (sección 11 del plan).
        ///
        /// <para>El historial <b>nunca se borra</b>: pasada la ventana simplemente deja
        /// de mostrarse, y si el streamer sube de tier reaparece entero. Las métricas
        /// agregadas usan todo el historial siempre, porque una distribución calculada
        /// sobre una ventana recortada le mentiría al streamer sobre su propia rueda.</para>
        /// </summary>
        public static readonly IReadOnlyDictionary<string, long> DefaultWheelHistoryDays =
            new Dictionary<string, long>
            {
                ["free"]      = 30,
                ["supporter"] = 90,
                ["premium"]   = 365,
                ["fundador"]  = Unlimited,
                [AdminTier]   = Unlimited
            };

        /// <summary>Días de historial visibles en el panel. <see cref="Unlimited"/> = todo.</summary>
        public static async Task<long> GetWheelHistoryDaysAsync(DecatronDbContext db, string tier)
        {
            var feature = await db.TierFeatures
                .FirstOrDefaultAsync(f => f.Tier == tier && f.FeatureKey == "wheel_of_luck_history_days");

            if (feature != null && long.TryParse(feature.FeatureValue, out var dbLimit))
                return dbLimit;

            return DefaultWheelHistoryDays.TryGetValue(tier, out var porDefecto)
                ? porDefecto
                : DefaultWheelHistoryDays["free"];
        }

        /// <summary>
        /// Tiers que pueden ocultar la marca de agua de Decatron del overlay de la
        /// Rueda (seccion 11 del plan). Free y supporter la llevan siempre: es la
        /// monetizacion indirecta de una feature que es gratis para todos.
        /// </summary>
        public static bool PuedeOcultarMarcaDeAgua(string tier) =>
            tier is "premium" or "fundador" or AdminTier;

        /// <summary>Valor sentinela para "sin límite".</summary>
        public const long Unlimited = -1;

        /// <summary>
        /// Orden de mejor a peor. Con cuentas vinculadas (Twitch+Kick, etc.) se usa
        /// para quedarse con el tier mas alto entre todos los canales de la cuenta —
        /// si pagaste Premium en cualquiera de tus canales, sos Premium en todos.
        /// </summary>
        private static readonly IReadOnlyDictionary<string, int> TierRank =
            new Dictionary<string, int>
            {
                [AdminTier]   = 4,
                ["fundador"]  = 3,
                ["premium"]   = 2,
                ["supporter"] = 1,
                ["free"]      = 0,
            };

        /// <summary>
        /// Todos los user_id que comparten cuenta con el dado (o solo el suyo si no
        /// tiene account_id) — mismo patron que FortniteService.GetAccountUserIdsAsync.
        /// Ver .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md seccion 8.11.
        /// </summary>
        private static async Task<List<long>> GetAccountUserIdsAsync(DecatronDbContext db, long userId)
        {
            var accountId = await db.Users
                .Where(u => u.Id == userId)
                .Select(u => u.AccountId)
                .FirstOrDefaultAsync();

            if (accountId == null)
                return new List<long> { userId };

            return await db.Users
                .Where(u => u.AccountId == accountId)
                .Select(u => u.Id)
                .ToListAsync();
        }

        public class TierDetails
        {
            public string Tier { get; set; } = "free";
            public DateTimeOffset? TierStartedAt { get; set; }
            public DateTimeOffset? TierExpiresAt { get; set; }
            public string? Source { get; set; }
        }

        /// <summary>
        /// Detalle completo del tier efectivo de la CUENTA (no del canal): los
        /// admins/owners de system_admins siempre son "admin" (aunque no tengan fila
        /// en user_subscription_tiers), el resto usa la mejor suscripcion activa
        /// entre todos los canales vinculados y cae a "free" si no hay ninguna.
        /// Unica fuente de verdad — GetEffectiveTierAsync/GetTierExpiryAsync y
        /// AuthController.GetAccountTier delegan aca en vez de repetir la consulta.
        /// </summary>
        public static async Task<TierDetails> GetEffectiveTierDetailsAsync(DecatronDbContext db, long userId)
        {
            var accountUserIds = await GetAccountUserIdsAsync(db, userId);

            var logins = await db.Users
                .Where(u => accountUserIds.Contains(u.Id))
                .Select(u => u.Login)
                .ToListAsync();

            var lowerLogins = logins.Where(l => !string.IsNullOrEmpty(l)).Select(l => l.ToLower()).ToList();
            if (lowerLogins.Count > 0)
            {
                var isAdmin = await db.SystemAdmins
                    .AnyAsync(a => lowerLogins.Contains(a.Username.ToLower()) &&
                                   (a.Role == "owner" || a.Role == "admin"));
                if (isAdmin) return new TierDetails { Tier = AdminTier };
            }

            var activeTiers = await db.UserSubscriptionTiers
                .Where(t => accountUserIds.Contains(t.UserId) &&
                            (t.TierExpiresAt == null || t.TierExpiresAt > DateTimeOffset.UtcNow))
                .Select(t => new { t.Tier, t.TierStartedAt, t.TierExpiresAt, t.Source })
                .ToListAsync();

            if (activeTiers.Count == 0)
                return new TierDetails { Tier = "free" };

            var winner = activeTiers
                .OrderByDescending(t => TierRank.TryGetValue(t.Tier, out var r) ? r : 0)
                .First();

            return new TierDetails
            {
                Tier = winner.Tier,
                TierStartedAt = winner.TierStartedAt,
                TierExpiresAt = winner.TierExpiresAt,
                Source = winner.Source
            };
        }

        /// <summary>Tier efectivo de la cuenta — ver GetEffectiveTierDetailsAsync.</summary>
        public static async Task<string> GetEffectiveTierAsync(DecatronDbContext db, long userId)
        {
            var details = await GetEffectiveTierDetailsAsync(db, userId);
            return details.Tier;
        }

        /// <summary>Fecha de expiración del tier activo de la cuenta — ver GetEffectiveTierDetailsAsync.</summary>
        public static async Task<DateTimeOffset?> GetTierExpiryAsync(DecatronDbContext db, long userId)
        {
            var details = await GetEffectiveTierDetailsAsync(db, userId);
            return details.TierExpiresAt;
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

        /// <summary>
        /// Límite de almacenamiento de medios (bytes) del tier. Devuelve
        /// <see cref="Unlimited"/> (-1) si el tier no tiene tope.
        /// </summary>
        public static async Task<long> GetStorageBytesLimitAsync(DecatronDbContext db, string tier)
        {
            var feature = await db.TierFeatures
                .FirstOrDefaultAsync(f => f.Tier == tier && f.FeatureKey == "media_storage_bytes");

            if (feature != null && long.TryParse(feature.FeatureValue, out var dbLimit))
                return dbLimit;

            return DefaultStorageLimits.TryGetValue(tier, out var defaultLimit) ? defaultLimit : DefaultStorageLimits["free"];
        }

        /// <summary>
        /// Cuántas Ruedas de la Suerte puede tener el canal. <see cref="Unlimited"/>
        /// (-1) si el tier no tiene tope.
        /// </summary>
        public static async Task<long> GetWheelLimitAsync(DecatronDbContext db, string tier)
        {
            var feature = await db.TierFeatures
                .FirstOrDefaultAsync(f => f.Tier == tier && f.FeatureKey == "wheel_of_luck_wheels");

            if (feature != null && long.TryParse(feature.FeatureValue, out var dbLimit))
                return dbLimit;

            return DefaultWheelLimits.TryGetValue(tier, out var defaultLimit) ? defaultLimit : DefaultWheelLimits["free"];
        }

        /// <summary>Cuántos gajos admite una rueda de este tier.</summary>
        public static async Task<long> GetWheelSegmentLimitAsync(DecatronDbContext db, string tier)
        {
            var feature = await db.TierFeatures
                .FirstOrDefaultAsync(f => f.Tier == tier && f.FeatureKey == "wheel_of_luck_segments");

            if (feature != null && long.TryParse(feature.FeatureValue, out var dbLimit))
                return dbLimit;

            return DefaultWheelSegmentLimits.TryGetValue(tier, out var defaultLimit)
                ? defaultLimit
                : DefaultWheelSegmentLimits["free"];
        }
    }
}
