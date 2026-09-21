using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.WheelOfLuck
{
    /// <summary>
    /// Tasa de conversión de una fuente de aporte a créditos, por rueda.
    ///
    /// <para>La tasa es una fracción y no un decimal a propósito: "1 sub = 500
    /// créditos" y "100 bits = 1 crédito" son la misma estructura, y no hay
    /// redondeo flotante que discuta con el saldo del espectador.</para>
    /// </summary>
    [Table("wheel_wallet_sources")]
    public class WheelWalletSource
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("wheel_id")]
        public int WheelId { get; set; }

        [ForeignKey("WheelId")]
        public Wheel? Wheel { get; set; }

        /// <summary>Ver <see cref="WheelSources"/>.</summary>
        [Required]
        [Column("source")]
        [MaxLength(20)]
        public string Source { get; set; } = string.Empty;

        /// <summary>Arranca apagada; el streamer decide qué fuentes acepta.</summary>
        [Column("is_enabled")]
        public bool IsEnabled { get; set; }

        [Column("rate_numerator")]
        public int RateNumerator { get; set; } = 1;

        [Column("rate_denominator")]
        public int RateDenominator { get; set; } = 1;

        /// <summary>Tope de créditos por evento individual. NULL = sin tope.</summary>
        [Column("cap_per_event")]
        public int? CapPerEvent { get; set; }

        /// <summary>
        /// Multiplica los créditos de un aporte de Tier 2. Solo aplica a
        /// <see cref="WheelSources.GiftSub"/>: es la única fuente por la que el tier
        /// llega — viene en el payload de EventSub de <c>channel.subscription.gift</c>,
        /// y por el chat NO llega (el badge de sub trae los meses, no el tier).
        ///
        /// <para>El Tier 1 es la base y siempre vale 1; no tiene columna porque no hay
        /// nada que configurar.</para>
        /// </summary>
        [Column("tier2_multiplier")]
        public decimal Tier2Multiplier { get; set; } = 1m;

        /// <summary>Multiplica los créditos de un aporte de Tier 3. Ver <see cref="Tier2Multiplier"/>.</summary>
        [Column("tier3_multiplier")]
        public decimal Tier3Multiplier { get; set; } = 1m;

        /// <summary>
        /// Solo para <see cref="WheelSources.ChannelPoints"/>: qué recompensa cuenta.
        ///
        /// <para>Una rueda puede tener varias filas de esta fuente, una por recompensa,
        /// porque el streamer suele crear variantes ("100 fichas", "500 fichas") y cada
        /// una da distinto. Las otras cuatro fuentes son una sola fila por rueda.</para>
        /// </summary>
        [Column("channel_points_reward_id")]
        [MaxLength(100)]
        public string? ChannelPointsRewardId { get; set; }

        /// <summary>
        /// Nombre de la recompensa, copiado de Twitch al elegirla. Se guarda para poder
        /// mostrarla sin volver a pedir la lista, y para que el panel siga diciendo algo
        /// si la recompensa se borra del canal.
        /// </summary>
        [Column("channel_points_reward_title")]
        [MaxLength(150)]
        public string? ChannelPointsRewardTitle { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Créditos que da <paramref name="cantidad"/> unidades de esta fuente, ya con el tope aplicado.</summary>
        public int Convertir(long cantidad, string? subTier = null)
        {
            if (RateDenominator <= 0) return 0;
            var creditos = cantidad * RateNumerator / RateDenominator;

            // El multiplicador de tier se aplica ANTES del tope por evento: el tope es
            // el techo de lo que un solo aporte puede dar, y aplicarlo antes dejaria
            // que un Tier 3 lo superara — el tope dejaria de ser un tope.
            var factor = MultiplicadorDeTier(subTier);
            if (factor != 1m) creditos = (long)Math.Floor(creditos * factor);

            if (CapPerEvent.HasValue && creditos > CapPerEvent.Value) creditos = CapPerEvent.Value;
            return creditos < 0 ? 0 : (int)Math.Min(creditos, int.MaxValue);
        }

        /// <summary>
        /// El multiplicador que corresponde a un tier de Twitch ("1000", "2000",
        /// "3000"). Cualquier otra cosa —null, un valor raro, o el tier en una fuente
        /// que no es gift_sub— vale 1.
        /// </summary>
        private decimal MultiplicadorDeTier(string? subTier)
        {
            if (Source != WheelSources.GiftSub || string.IsNullOrWhiteSpace(subTier)) return 1m;
            return subTier switch
            {
                "2000" => Tier2Multiplier <= 0 ? 1m : Tier2Multiplier,
                "3000" => Tier3Multiplier <= 0 ? 1m : Tier3Multiplier,
                _ => 1m,
            };
        }
    }

    /// <summary>Las cinco fuentes, para recorrerlas sin repetir la lista en cada sitio.</summary>
    public static class WheelSourceCatalog
    {
        public static readonly string[] All =
        {
            WheelSources.Bits,
            WheelSources.GiftSub,
            WheelSources.Donation,
            WheelSources.ChannelPoints,
            WheelSources.DecaCoins,
        };

        /// <summary>
        /// Las fuentes que hoy tienen quien las dispare de verdad. Solo estas se le
        /// ofrecen al streamer en el panel.
        ///
        /// <see cref="WheelSources.Donation"/> queda fuera a proposito: el modelo, la
        /// conversion y el simulador la soportan entera, pero ninguna integracion real
        /// llama a CreditAsync con ella, asi que un streamer la encenderia y no pasaria
        /// nada. Vuelve al panel cuando tenga productor: hay que engancharla en
        /// TipsService.RecordTip, que ya es el unico camino real de una donacion
        /// (PayPal), y antes decidir como se resuelve el donante (nombre libre de
        /// PayPal) a un login de Twitch.
        /// </summary>
        public static readonly string[] Wired =
        {
            WheelSources.Bits,
            WheelSources.GiftSub,
            WheelSources.ChannelPoints,
            // deca_coins ya tiene productor: el comando de compra (`!dcomprar` por
            // defecto), que gasta coins via CoinService. No es un aporte que llega
            // sino una compra, y por eso necesitaba un comando y no un enganche.
            WheelSources.DecaCoins,
        };
    }

    /// <summary>De dónde puede venir un crédito.</summary>
    public static class WheelSources
    {
        public const string Bits          = "bits";
        public const string GiftSub       = "gift_sub";
        public const string Donation      = "donation";
        public const string ChannelPoints = "channel_points";
        /// <summary>Soportada pero apagada por defecto: casi nadie usa deca coins.</summary>
        public const string DecaCoins     = "deca_coins";
    }
}
