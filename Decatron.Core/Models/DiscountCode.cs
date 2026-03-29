using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("discount_codes")]
    public class DiscountCode
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        [Column("code")]
        public string Code { get; set; } = string.Empty;

        /// <summary>"fixed" | "percent"</summary>
        [Required]
        [MaxLength(10)]
        [Column("discount_type")]
        public string DiscountType { get; set; } = "percent";

        [Column("discount_value")]
        public decimal DiscountValue { get; set; }

        /// <summary>"all" | "supporter" | "premium" | "fundador"</summary>
        [MaxLength(20)]
        [Column("applies_to")]
        public string AppliesTo { get; set; } = "all";

        [Column("max_uses")]
        public int? MaxUses { get; set; }

        [Column("used_count")]
        public int UsedCount { get; set; } = 0;

        [Column("expires_at")]
        public DateTime? ExpiresAt { get; set; }

        [Column("active")]
        public bool Active { get; set; } = true;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
