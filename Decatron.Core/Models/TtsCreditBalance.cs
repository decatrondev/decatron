using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    /// <summary>
    /// Saldo de créditos TTS de un canal. 1 crédito = 1 carácter de voz standard.
    ///
    /// Bolsas premium (Polly): la mensual, que se reinicia el día 1, y la comprada,
    /// que no caduca. Aparte va la bolsa de voz estándar (Piper), que también se
    /// reinicia cada mes pero ni se compra ni se mezcla con las otras: su coste es
    /// CPU del servidor, no dólares de AWS.
    /// </summary>
    [Table("tts_credit_balances")]
    public class TtsCreditBalance
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("user_id")]
        public long UserId { get; set; }

        /// <summary>Primer día del mes al que corresponde la bolsa mensual.</summary>
        [Column("monthly_period")]
        public DateTime MonthlyPeriod { get; set; }

        [Column("monthly_granted")]
        public long MonthlyGranted { get; set; }

        [Column("monthly_used")]
        public long MonthlyUsed { get; set; }

        /// <summary>Puede quedar negativo tras un reembolso.</summary>
        [Column("purchased_balance")]
        public long PurchasedBalance { get; set; }

        /// <summary>Cuota mensual de voz estándar (Piper), independiente de la premium.</summary>
        [Column("standard_granted")]
        public long StandardGranted { get; set; }

        [Column("standard_used")]
        public long StandardUsed { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        [NotMapped]
        public long MonthlyRemaining => Math.Max(0, MonthlyGranted - MonthlyUsed);

        [NotMapped]
        public long TotalAvailable => MonthlyRemaining + PurchasedBalance;

        [NotMapped]
        public long StandardRemaining => Math.Max(0, StandardGranted - StandardUsed);
    }
}
