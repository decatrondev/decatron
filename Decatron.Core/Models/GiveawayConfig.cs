using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;
using System.Text.Json.Serialization;
using Decatron.Core.Converters;

namespace Decatron.Core.Models
{
    [Table("giveaway_configs")]
    public class GiveawayConfig
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("channel_id")]
        [MaxLength(255)]
        public string ChannelId { get; set; } = string.Empty;

        // Información básica
        [Required]
        [Column("name")]
        [MaxLength(255)]
        public string Name { get; set; } = "Nuevo Giveaway";

        [Required]
        [Column("prize_name")]
        [MaxLength(500)]
        public string PrizeName { get; set; } = string.Empty;

        [Column("prize_description")]
        public string? PrizeDescription { get; set; }

        // Duración
        [Required]
        [Column("duration_type")]
        [MaxLength(10)]
        public string DurationType { get; set; } = "timed"; // 'manual' | 'timed'

        [Column("duration_minutes")]
        public int DurationMinutes { get; set; } = 10;

        // Participantes
        [Column("max_participants")]
        public int MaxParticipants { get; set; } = 1000;

        [Column("max_participants_enabled")]
        public bool MaxParticipantsEnabled { get; set; } = false;

        [Column("allow_multiple_entries")]
        public bool AllowMultipleEntries { get; set; } = false;

        // Ganadores
        [Column("number_of_winners")]
        public int NumberOfWinners { get; set; } = 1;

        [Column("has_backup_winners")]
        public bool HasBackupWinners { get; set; } = true;

        [Column("number_of_backup_winners")]
        public int NumberOfBackupWinners { get; set; } = 2;

        // Método de entrada
        [Column("entry_command")]
        [MaxLength(100)]
        public string EntryCommand { get; set; } = "!join";

        [Column("allow_auto_entry")]
        public bool AllowAutoEntry { get; set; } = false;

        // Requisitos (JSONB)
        [Required]
        [Column("requirements", TypeName = "jsonb")]
        [JsonConverter(typeof(JsonStringConverter))]
        public string Requirements { get; set; } = "{}";

        // Pesos (JSONB)
        [Required]
        [Column("weights", TypeName = "jsonb")]
        [JsonConverter(typeof(JsonStringConverter))]
        public string Weights { get; set; } = "{}";

        // Cooldown
        [Column("winner_cooldown_enabled")]
        public bool WinnerCooldownEnabled { get; set; } = true;

        [Column("winner_cooldown_days")]
        public int WinnerCooldownDays { get; set; } = 7;

        // Anuncios
        [Column("announce_on_start")]
        public bool AnnounceOnStart { get; set; } = true;

        [Column("announce_reminders")]
        public bool AnnounceReminders { get; set; } = true;

        [Column("reminder_interval_minutes")]
        public int ReminderIntervalMinutes { get; set; } = 3;

        [Column("announce_participant_count")]
        public bool AnnounceParticipantCount { get; set; } = true;

        // Mensajes personalizados
        [Column("start_message")]
        public string? StartMessage { get; set; }

        [Column("reminder_message")]
        public string? ReminderMessage { get; set; }

        [Column("winner_message")]
        public string? WinnerMessage { get; set; }

        [Column("no_response_message")]
        public string? NoResponseMessage { get; set; }

        // Timeout
        [Column("winner_response_timeout")]
        public int WinnerResponseTimeout { get; set; } = 60;

        [Column("auto_reroll_on_timeout")]
        public bool AutoRerollOnTimeout { get; set; } = true;

        // Metadata
        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
