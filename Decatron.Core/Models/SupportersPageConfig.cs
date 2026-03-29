using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("supporters_page_config")]
    public class SupportersPageConfig
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("config_json")]
        public string ConfigJson { get; set; } = "{}";

        [Column("tiers_json")]
        public string TiersJson { get; set; } = "[]";

        [Column("updated_at")]
        public DateTimeOffset? UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
