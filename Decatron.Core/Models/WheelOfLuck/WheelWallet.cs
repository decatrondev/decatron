using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models.WheelOfLuck
{
    /// <summary>
    /// Billetera de Aportes: saldo de créditos de un espectador en un canal.
    ///
    /// <para>La billetera es del canal y no de la rueda: el espectador aporta una
    /// vez y puede gastar en cualquier rueda de ese streamer.</para>
    /// </summary>
    [Table("wheel_wallets")]
    public class WheelWallet
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("channel_id")]
        public long ChannelId { get; set; }

        [ForeignKey("ChannelId")]
        public User? Channel { get; set; }

        /// <summary>
        /// Nulo mientras el espectador no tenga cuenta en Decatron. El login es lo
        /// único que siempre hay, y por eso es él quien lleva la unicidad.
        /// </summary>
        [Column("viewer_user_id")]
        public long? ViewerUserId { get; set; }

        [Required]
        [Column("viewer_login")]
        [MaxLength(100)]
        public string ViewerLogin { get; set; } = string.Empty;

        [Column("credits")]
        public int Credits { get; set; }

        /// <summary>Histórico, nunca baja. Sobrevive a la caducidad de los créditos.</summary>
        [Column("lifetime_credits")]
        public int LifetimeCredits { get; set; }

        [Column("last_activity_at")]
        public DateTime LastActivityAt { get; set; } = DateTime.UtcNow;

        /// <summary>Giros seguidos sin premio, para la piedad.</summary>
        [Column("pity_counter")]
        public int PityCounter { get; set; }

        /// <summary>
        /// Giros gastados en el stream actual. Se pone en cero con stream.online, que
        /// es el único momento en que "por stream" significa algo verificable.
        /// </summary>
        [Column("spins_this_stream")]
        public int SpinsThisStream { get; set; }

        /// <summary>Para el cooldown entre giros del mismo espectador.</summary>
        [Column("last_spin_at")]
        public DateTime? LastSpinAt { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
