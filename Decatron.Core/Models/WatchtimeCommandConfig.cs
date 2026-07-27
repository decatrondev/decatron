using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Decatron.Core.Models
{
    [Table("watchtime_command_configs")]
    public class WatchtimeCommandConfig
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("user_id")]
        public long UserId { get; set; }

        [ForeignKey("UserId")]
        public User? ChannelUser { get; set; }

        [Column("enabled")]
        public bool Enabled { get; set; } = true;

        [Required]
        [Column("command_name")]
        [MaxLength(50)]
        public string CommandName { get; set; } = "!watchtime";

        [Column("cooldown_global")]
        public int CooldownGlobal { get; set; } = 5;

        [Column("cooldown_user")]
        public int CooldownUser { get; set; } = 30;

        // Nivel mínimo requerido: everyone, subscriber, vip, moderator, lead_moderator, broadcaster
        [Column("permission")]
        [MaxLength(20)]
        public string Permission { get; set; } = "everyone";

        [Column("track_lurkers")]
        public bool TrackLurkers { get; set; } = true;

        [Column("min_minutes_to_respond")]
        public int MinMinutesToRespond { get; set; } = 0;

        // minutes, hours_minutes, full
        [Column("time_format")]
        [MaxLength(20)]
        public string TimeFormat { get; set; } = "full";

        [Column("show_position")]
        public bool ShowPosition { get; set; } = true;

        [Column("only_when_live")]
        public bool OnlyWhenLive { get; set; } = false;

        [Column("custom_message")]
        public string CustomMessage { get; set; } = "@{user} llevas {hours} hora(s) {minutes} minuto(s) viendo el stream";

        [Column("use_first_time_message")]
        public bool UseFirstTimeMessage { get; set; } = true;

        [Column("first_time_message")]
        public string FirstTimeMessage { get; set; } = "@{user} ¡es tu primera vez en el stream! Ya llevas {hours} hora(s) {minutes} minuto(s) — ¡bienvenido/a!";

        [Column("use_not_enough_time_message")]
        public bool UseNotEnoughTimeMessage { get; set; } = true;

        [Column("not_enough_time_message")]
        public string NotEnoughTimeMessage { get; set; } = "@{user} aún llevas muy poco tiempo, ¡sigue viendo el stream!";

        [Column("use_offline_message")]
        public bool UseOfflineMessage { get; set; } = false;

        [Column("offline_message")]
        public string OfflineMessage { get; set; } = "@{user} el stream no está en vivo ahora mismo";

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
